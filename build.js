#!/usr/bin/env node
const sh = require('shelljs');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const ShapeShifter = require('regpack/shapeShifter');
const advzipPath = require('advzip-bin');
const definitionsJson = require('./src/definitions.json');

const DEBUG = process.argv.indexOf('--debug') >= 0;
const MONO_RUN = process.platform === 'win32' ? '' : 'mono ';

const g_shaderExternalNameMap = {};

const run = cmd =>
{
    const code = sh.exec( cmd ).code;
    if( code !== 0 )
        process.exit( code );
};

const replaceSimple = (x, y, z) =>
{
    const idx = x.indexOf( y );
    if( idx < 0 ) return x;
    return x.substr( 0, idx ) + z + x.substr( idx + y.length );
};

const applyStateMap = code =>
{
    for( let k in definitionsJson.constants )
        code = code.replace( new RegExp( k, 'g' ), definitionsJson.constants[k] );

    for( let i in definitionsJson.stateFields )
        code = code.replace( new RegExp( definitionsJson.stateFields[i], 'g' ), i );

    return code;
};

const hashWebglIdentifiers = ( js, and2dContext ) =>
{
    let result = new ShapeShifter().preprocess(js, {
        hashWebGLContext: true,
        contextVariableName: 'g',
        contextType: 1,
        reassignVars: true,
        varsNotReassigned: ['A','b','g','c'],
        useES6: true,
    })[2].contents;

    result = result.replace('for(', 'for(let ');

    if( and2dContext )
    {
        result = new ShapeShifter().preprocess(result, {
            hash2DContext: true,
            contextVariableName: 'c',
            contextType: 0,
            reassignVars: true,
            varsNotReassigned: ['A','b','g','c'],
            useES6: true,
        })[2].contents;

        result = result.replace('for(', 'for(let ');
    }

    return result;
};

const buildShaderExternalNameMap = shaderCode =>
{
    let i = 0;
    _.uniq( shaderCode.match(/[vau]_[a-zA-Z0-9]+/g) )
        .forEach( x => g_shaderExternalNameMap[x] = `x${i++}` );
};

const minifyShaderExternalNames = code =>
{
    for( let k in g_shaderExternalNameMap )
        code = code.replace( new RegExp( k, 'g' ), g_shaderExternalNameMap[k] );

    return code;
};

const convertStateAccessNotation = shaderCode =>
{
    // i.e. ST.wheelPos[2] -> g_state[s_wheelPos2];
    //      ST.wheelLastPos[i] -> g_state[s_wheelLastPos0 + i * s_wheelStructSize ];

    let match;
    while( match = shaderCode.match( /ST\.[a-zA-Z0-9\[\]]+/ ))
    {
        const str = match[0];
        let newStr = str;

        if( str.endsWith(']'))
        {
            const idx = str.match(/\[(.+)\]/)[1];
            const propName = str.replace('ST.', '').replace(/\[.*/, '');
            const structName = propName.match(/^[a-z]+/)[0];

            if( isNaN( parseInt( idx )))
                newStr = `g_state[s_${propName}0 + ${idx} * s_${structName}StructSize]`;
            else
                newStr = `g_state[s_${propName}${idx}]`;
        }
        else
        {
            const propName = str.replace('ST.', '');
            newStr = `g_state[s_${propName}]`;
        }

        shaderCode = shaderCode.substr( 0, match.index ) + newStr + shaderCode.substr( match.index + str.length );
    }

    return shaderCode;
};

const convertHLSLtoGLSL = hlsl =>
{
    const glslOverride = '//GLSL//';

    let lines = hlsl
        .replace(/float3x3/g, 'mat3')
        .replace(/float2x2/g, 'mat2')
        .replace(/float2/g, 'vec2')
        .replace(/float3/g, 'vec3')
        .replace(/float4/g, 'vec4')
        .replace(/lerp/g, 'mix')
        .replace(/frac/g, 'fract')
        .replace(/atan2/g, 'atan')
        .replace(/transpose_hlsl_only/g, '')
        .replace(/static /g, '')
        .split('\n');

    lines = lines.map( x =>
    {
        const idx = x.indexOf(glslOverride);
        return idx >= 0
            ? x.substr( idx + glslOverride.length )
            : x;
    });

    return lines.join('\n');
}

const insertWorldSDFCode = shaderCode =>
{
    const sdfDefs = convertHLSLtoGLSL( fs.readFileSync( 'src/sdfDefs.hlsl', 'utf8' ));
    const tracks = sh.ls( 'tracks' )
        .map( x => '#ifdef T' + x.replace(/[^0-9]/g, '') + '\n' + fs.readFileSync( 'tracks/' + x, 'utf8' ) + '\n' + '#endif' )
        .join('\n')
        .split('\n')
        .map( x => x.trim().startsWith('const') ? '' : x )
        .join('\n');

    return shaderCode.replace( '#pragma INCLUDE_WORLD_SDF', sdfDefs + '\n' + tracks + '\n' );
};

const preprocessShader = shaderCode =>
    applyStateMap( convertStateAccessNotation( insertWorldSDFCode( shaderCode )));

const reinsertTrackConstants = shaderGenTS =>
{
    const lines = shaderGenTS.split('\n');

    sh.ls( 'tracks' ).forEach( x =>
    {
        const trackId = x.replace(/[^0-9]/g, '');
        const consts = fs.readFileSync( 'tracks/' + x, 'utf8' )
            .split('\n')
            .filter( x => x.trim().startsWith('const') )
            .map( x => '"' + x + '" +' )
            .join('\n');

        for( let i = 0; i < lines.length; ++i )
        {
            if( lines[i].indexOf('T'+trackId) >= 0 )
            {
                lines.splice( i+1, 0, consts );
                break;
            }
        }
    });

    return lines.join('\n');
}

const generateShaderFile = () =>
{
    sh.mkdir( '-p', 'shadersTmp' );
    sh.ls( 'src' ).forEach( x =>
    {
        if( x.endsWith('.frag') || x.endsWith('.vert'))
        {
            const code = fs.readFileSync( path.resolve( 'src', x ), 'utf8' );
            fs.writeFileSync( path.resolve( 'shadersTmp', x ), preprocessShader( code ));
        }
    });

    run( MONO_RUN + 'tools/shader_minifier.exe --no-renaming-list main,Xmap --format js -o build/shaders.js --preserve-externals '+(DEBUG ? '--preserve-all-globals' : '')+' shadersTmp/*' );
    let shaderCode = fs.readFileSync('build/shaders.js', 'utf8');
    buildShaderExternalNameMap( shaderCode );
    shaderCode = minifyShaderExternalNames( shaderCode );

    shaderCode = shaderCode
        .split('\n')
        .map( x => x.replace(/^var/, 'export let'))
        .join('\n');

    shaderCode = reinsertTrackConstants( shaderCode );

    if( DEBUG )
        shaderCode = shaderCode.replace(/" \+/g, '\\n" +');

    fs.writeFileSync( 'src/shaders.gen.ts', shaderCode );

    sh.rm( '-rf', 'shadersTmp' );
};

const wrapWithHTML = js =>
{
    let htmlTemplate = fs.readFileSync( DEBUG ? 'src/index.debug.html' : 'src/index.release.html', 'utf8' );

    if( !DEBUG ) htmlTemplate = htmlTemplate
        .split('\n')
        .map( line => line.trim() )
        .join('')
        .trim();

    return replaceSimple(htmlTemplate, '__CODE__', js.trim());
};

const main = () =>
{
    definitionsJson.constants.s_totalStateSize = definitionsJson.stateFields.length;
    definitionsJson.constants.s_totalStateSizeX4 = 4 * definitionsJson.stateFields.length;

    sh.cd( __dirname );
    sh.mkdir( '-p', 'build' );

    fs.writeFileSync( 'src/debug.gen.ts', `export const DEBUG = ${DEBUG ? 'true' : 'false'};\n` );

    console.log('Minifying shaders...');
    generateShaderFile();
    console.log('Compiling typescript...');
    run( 'tsc --outDir build' );
    console.log('Rolling up bundle...');
    run( 'rollup -c' + ( DEBUG ? ' --config-debug' : '' ));

    let x = fs.readFileSync('build/bundle.js', 'utf8');
    x = minifyShaderExternalNames( x );
    if( !DEBUG ) x = hashWebglIdentifiers( x, true );
    x = wrapWithHTML( x );
    x = applyStateMap( x );
    fs.writeFileSync( 'build/index.html', x );

    if( !DEBUG )
    {
        run( advzipPath + ' --shrink-insane -i 10 -a out.zip build/index.html' );

        const zipStat = fs.statSync('out.zip');
        const percent = Math.floor((zipStat.size / 13312) * 100);
        console.log(''); 
        console.log(`  Final bundle size: ${zipStat.size} / 13312 bytes (${percent} %)`);
        console.log(''); 
    }
};

main();
