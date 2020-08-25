import { terser } from 'rollup-plugin-terser';

const DEBUG = process.argv.indexOf( '--config-debug' ) >= 0;

export default {
  input: 'build/index.js',
  output: {
    file: 'build/bundle.js',
    strict: false,
  },
  plugins: DEBUG ? [] : [ terser({
    compress: {
      passes: 4,
      unsafe: true,
      unsafe_arrows: true,
      unsafe_comps: true,
      unsafe_math: true,
    },
    mangle: {
      reserved: ['a','b','g','c'],
      properties: true, // { debug: true }, // ( enabling debug on property mangle makes error messages slightly more readable )
    },
    format: {
      quote_style: 1
    }
  })]
};