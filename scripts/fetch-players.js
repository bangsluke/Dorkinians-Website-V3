const { execSync } = require('child_process');

async function fetchPlayers() {
  try {
    // Use jest to run a simple test that just fetches the data
    const script = `
      const { fetchTestData } = require('./__tests__/utils/testUtils.ts');
      fetchTestData().then(data => {
        console.log('PLAYERS_START');
        data.forEach(player => {
          console.log(player.playerName);
        });
        console.log('PLAYERS_END');
      }).catch(err => {
        console.error('ERROR:', err.message);
      });
    `;
    
    const output = execSync(`node -e "${script}"`, { 
      encoding: 'utf8',
      cwd: process.cwd()
    });
    
    const startIndex = output.indexOf('PLAYERS_START');
    const endIndex = output.indexOf('PLAYERS_END');
    
    if (startIndex !== -1 && endIndex !== -1) {
      const playersText = output.substring(startIndex + 'PLAYERS_START'.length, endIndex).trim();
      return playersText.split('\n').filter(name => name.trim());
    }
    
    return [];
  } catch (error) {
    console.error('Error:', error.message);
    return [];
  }
}

fetchPlayers().then(players => {
  console.log('Players found:', players);
}).catch(console.error);
