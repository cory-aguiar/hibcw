const fs = require("fs");

const config = `const SUPABASE_URL = "${process.env.SUPABASE_URL}";
const SUPABASE_ANON_KEY = "${process.env.SUPABASE_ANON_KEY}";
`;

fs.writeFileSync("config.js", config);
console.log("config.js generated from environment variables.");
