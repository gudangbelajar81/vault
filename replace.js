const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('D:/PROJEK/saas/vaultpro/frontend/src');
let changedFiles = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    // Regex to match 'http://localhost:5001/...' or "http://localhost:5001/..."
    // We will replace http://localhost:5001 with 
    // To do this safely inside existing string literals, we can replace the static string with a template literal.
    
    let newContent = content.replace(/['"]http:\/\/localhost:5001([^'"]*)['"]/g, "${import.meta.env.VITE_API_URL || 'http://localhost:5001'}");
    
    if (content !== newContent) {
        fs.writeFileSync(file, newContent, 'utf8');
        console.log('Updated:', file);
        changedFiles++;
    }
});
console.log('Total files changed:', changedFiles);
