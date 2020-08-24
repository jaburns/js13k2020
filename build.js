#!/usr/bin/env node
const sh = require('shelljs');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const ShapeShifter = require('regpack/shapeShifter');
const advzipPath = require('advzip-bin');
const stateMap = require('./src/definitions.json');

const DEBUG = process.argv.indexOf('--debug') >= 0;
const MONO_RUN = process.platform === 'win32' ? '' : 'mono ';

const g_shaderExternalNameMap = {};

sh.cd( __dirname );

const run = cmd =>
{
    const code = sh.exec( cmd ).code;
    if( code !== 0 )
        process.exit( code );
};

const applyStateMap = code =>
{
    code = code.replace( /s_totalStateSize/g, stateMap.stateFields.length );

    for( let k in stateMap.constants )
        if( k !== 's_totalStateSize' )
            code = code.replace( new RegExp( k, 'g' ), stateMap.constants[k] );

    for( let i in stateMap.stateFields )
        code = code.replace( new RegExp( stateMap.stateFields[i], 'g' ), i );

    return code;
};

const hashWebglIdentifiers = js =>
{
    let result = new ShapeShifter().preprocess(js, {
        hashWebGLContext: true,
        contextVariableName: 'g',
        contextType: 1,
        reassignVars: true,
        varsNotReassigned: ['g','a'],
        useES6: true,
    })[2].contents;

    if( result.startsWith('for(') )
        result = result.replace('for(', 'for(let ');

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

// i.e.
//  ST.wheelPos[2] -> g_state[s_wheelPos2];
//  ST.wheelLastPos[i] -> g_state[s_wheelLastPos0 + i * s_wheelStructSize ];
const convertStateAccessNotation = shaderCode =>
{
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

const preprocessShader = shaderCode =>
    applyStateMap( convertStateAccessNotation( shaderCode ));

const generateShaderFile = () =>
{
    sh.mkdir( '-p', 'shadersTmp' );
    sh.ls( 'shaders' ).forEach( x =>
    {
        const code = fs.readFileSync( path.resolve( 'shaders', x ), 'utf8' );
        fs.writeFileSync( path.resolve( 'shadersTmp', x ), preprocessShader( code ));
    });

    run( MONO_RUN + 'tools/shader_minifier.exe --no-renaming-list main,m0,m1,MS --format js -o build/shaders.js --preserve-externals shadersTmp/*' );
    let shaderCode = fs.readFileSync('build/shaders.js', 'utf8');
    buildShaderExternalNameMap( shaderCode );
    shaderCode = minifyShaderExternalNames( shaderCode );

    shaderCode = shaderCode
        .split('\n')
        .map( x => x.replace(/^var/, 'export let'))
        .join('\n');

    fs.writeFileSync('src/shaders.gen.ts', shaderCode);

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

    return htmlTemplate.replace('__CODE__', js.trim());
};

const main = () =>
{
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
    if( !DEBUG ) x = hashWebglIdentifiers( x );
    x = applyStateMap( x );
    x = wrapWithHTML( x );
    fs.writeFileSync( 'build/out.html', x );

    if( !DEBUG )
    {
        run( advzipPath + ' --shrink-insane -i 10 -a out.zip build/out.html' );

        const zipStat = fs.statSync('out.zip');
        const percent = Math.floor((zipStat.size / 13312) * 100);
        console.log(''); 
        console.log(`  Final bundle size: ${zipStat.size} / 13312 bytes (${percent} %)`);
        console.log(''); 
    }
};

main();