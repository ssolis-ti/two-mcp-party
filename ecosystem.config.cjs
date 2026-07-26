module.exports = {
  apps: [{
    name: "agentbridge-mcp",
    script: "./src/index.js",
    watch: false,
    env: {
      NODE_ENV: "production"
    },
    env_development: {
      NODE_ENV: "development",
      DEBUG_MODE: "true"
    }
  }]
};
