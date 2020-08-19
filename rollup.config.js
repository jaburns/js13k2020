import { terser } from 'rollup-plugin-terser';

export default {
  input: 'build/index.js',
  output: {
    file: 'build/bundle.js',
    strict: false,
  },
  plugins: [ terser({
    mangle: {
      reserved: ['g','a','o'],
      properties: true, // { debug: true },
    },
    format: {
      quote_style: 1
    }
  })]
};