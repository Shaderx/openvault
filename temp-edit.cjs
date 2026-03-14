const fs = require('fs');
let content = fs.readFileSync('src/prompts/index.js', 'utf8');

// The old rules section (rules 4-7) - with Windows line endings
const oldRules = `4. Do NOT wrap output in markdown code blocks (no \\\`\\\`\\\`json).\r\n5. Do NOT include ANY text outside the <thinking> tags and the JSON object.\r\n6. Keep character names exactly as they appear in the input.\r\n7. Start your response with { after the </thinking> close tag. No other wrapping.`;

// The new rules section (rules 4-8 with new rule 5) - with Windows line endings
const newRules = `4. Do NOT wrap output in markdown code blocks (no \\\`\\\`\\\`json).\r\n5. Do NOT use <tool_call> or function schemas. Output directly to the chat as plain text.\r\n6. Do NOT include ANY text outside the <thinking> tags and the JSON object.\r\n7. Keep character names exactly as they appear in the input.\r\n8. Start your response with { after the </thinking> close tag. No other wrapping.`;

if (content.includes(oldRules)) {
    content = content.replace(oldRules, newRules);
    fs.writeFileSync('src/prompts/index.js', content, 'utf8');
    console.log('SUCCESS: Rules updated');
} else {
    console.log('ERROR: Could not find the rules section');
}
