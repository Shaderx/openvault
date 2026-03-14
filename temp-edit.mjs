import fs from 'fs';

const content = fs.readFileSync('src/prompts/index.js', 'utf8');

// The old rules section (rules 4-7)
const oldRules = `4. Do NOT wrap output in markdown code blocks (no \\\`\\\`\\\`json).\r\n5. Do NOT include ANY text outside the <thinking> tags and the JSON object.\r\n6. Keep character names exactly as they appear in the input.\r\n7. Start your response with { after the </thinking> close tag. No other wrapping.`;

// The new rules section (rules 4-8 with new rule 5)
const newRules = `4. Do NOT wrap output in markdown code blocks (no \\\`\\\`\\\`json).\r\n5. Do NOT use <tool_call> or function schemas. Output directly to the chat as plain text.\r\n6. Do NOT include ANY text outside the <thinking> tags and the JSON object.\r\n7. Keep character names exactly as they appear in the input.\r\n8. Start your response with { after the </thinking> close tag. No other wrapping.`;

console.log('Old rules length:', oldRules.length);
console.log('New rules length:', newRules.length);

// Check if oldRules exists
const idx = content.indexOf(oldRules);
console.log('Index of oldRules:', idx);

if (idx >= 0) {
    const newContent = content.replace(oldRules, newRules);
    fs.writeFileSync('src/prompts/index.js', newContent, 'utf8');
    console.log('SUCCESS: Rules updated');
} else {
    console.log('ERROR: Could not find the rules section');
    // Debug: show what's at the expected position
    const debugIdx = content.indexOf('4. Do NOT wrap output in markdown code blocks');
    console.log('Found "4. Do NOT wrap" at index:', debugIdx);
    if (debugIdx >= 0) {
        const actualContent = content.slice(debugIdx, debugIdx + oldRules.length + 10);
        console.log('Actual content there:');
        console.log(JSON.stringify(actualContent));
    }
}
