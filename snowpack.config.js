// Example: snowpack.config.js
// The added "@type" comment will enable TypeScript type information via VSCode, etc.

/** 
 * @type {import("snowpack").SnowpackUserConfig } 
*/


module.exports = {
    mount: {
        public: '/',
        src: '/_dist_'
    },
    plugins: [
      '@snowpack/plugin-dotenv',
      '@snowpack/plugin-typescript',
      '@snowpack/plugin-postcss'
    ],
}