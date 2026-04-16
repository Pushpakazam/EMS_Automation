const fs = require('fs');

function getCSVDataSync(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const rows = fileContent.split('\n').slice(1);

  return rows
    .filter(row => row.trim() !== '')
    .map(row => {
      const [id, username, password, type] = row.split(',');
      return {
        id: id.trim(),
        username: username.trim(),
        password: password.trim(),
        type: type.trim()
      };
    });
}

module.exports = { getCSVDataSync };
