// Example: snowpack.config.js
// The added "@type" comment will enable TypeScript type information via VSCode, etc.

/** 
 * @type {import("snowpack").SnowpackUserConfig } 
*/


module.exports = {
    mount: {

    },
    plugins: [
        '@snowpack/plugin-dotenv',
        '@snowpack/plugin-typescript'
    ]
}