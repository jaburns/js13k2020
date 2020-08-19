#!/usr/bin/env node
const sh = require('shelljs');
const fs = require('fs');
const ShapeShifter = require('regpack/shapeShifter');

sh.cd( __dirname );

const run = cmd =>
{
    const code = sh.exec( cmd ).code;
    if( code !== 0 )
        process.exit( code );
};

const buildBundle = () =>
{
	run( 'tsc --outDir build' );
	run( 'rollup -c' );
};

const regpacked = js =>
{
	return new ShapeShifter().preprocess(js, {
		hashWebGLContext: true,
		contextVariableName: 'g',
		contextType: 1,
		reassignVars: true,
		varsNotReassigned: ['g','a'],
		useES6: true,
	})[2].contents;
};

const fixDoubleQuotes = js =>
	js.replace(/"/g, "'");

const wrapWithHTML = js =>
{
	const htmlTemplate = fs.readFileSync('src/index.html', 'utf8')
		.split('\n')
		.map( line => line.trim() )
		.join('');

	return htmlTemplate.replace('__CODE__', js);
};

const main = () =>
{
	buildBundle();

	let x = fs.readFileSync('build/bundle.js', 'utf8');
	x = regpacked( x );
	x = fixDoubleQuotes( x );
	x = wrapWithHTML( x );

	fs.writeFileSync( 'build/out.html', x );

	run( 'tools/advzip/advzip-linux-x64 --shrink-insane -i 10 -a out.zip build/out.html' );

	const zipStat = fs.statSync('out.zip');
	const percent = Math.floor((zipStat.size / 13312) * 100) / 100;

	console.log(''); 
	console.log(`  Final bundle size: ${zipStat.size} / 13312 bytes (${percent} %)`);
	console.log(''); 
};

main();