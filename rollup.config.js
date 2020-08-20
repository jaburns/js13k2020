import { terser } from 'rollup-plugin-terser';

const DEBUG = process.argv.indexOf( '--config-debug' ) >= 0;

export default {
  input: 'build/index.js',
  output: {
    file: 'build/bundle.js',
    strict: false,
  },
  plugins: DEBUG ? [] : [ terser({
    mangle: {
      reserved: ['g','a'],
      properties: true, // { debug: true }, // ( enabling debug on property mangle makes error messages slightly more readable )
    },
    format: {
      quote_style: 1
    }
  })]
};