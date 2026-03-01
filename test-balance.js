const fs = require('fs');

async function checkSchema() {
    const envFile = fs.readFileSync('.env.local', 'utf8');
    const keyMatch = envFile.match(/RUNPOD_API_KEY=(.*)/);
    if (!keyMatch) {
        console.log('API key not found');
        return;
    }
    const key = keyMatch[1].trim();
    const query = `
      query {
        myself {
           id
           pubKey
           credit
        }
      }
    `;
    const res = await fetch('https://api.runpod.io/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({ query })
    });
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));

    const balanceQuery = `
      query {
        __type(name: "Account") {
          fields {
            name
            type { name }
          }
        }
      }
    `;
    const res2 = await fetch('https://api.runpod.io/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({ query: balanceQuery })
    });
    const json2 = await res2.json();
    console.log("Account type fields:", JSON.stringify(json2, null, 2));
}
checkSchema().catch(console.error);
