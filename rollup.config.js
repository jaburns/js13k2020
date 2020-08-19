import { terser } from 'rollup-plugin-terser';

export default {
  input: 'build/index.js',
  output: {
    file: 'build/bundle.js',
    strict: false,
  },
  plugins: [ terser() ]
};