import { getConfig } from './lib/config'
import axios from 'axios'

async function checkBalance() {
    const key = await getConfig('RUNPOD_API_KEY')
    const query = `
      query {
        myself {
          id
          pubKey
          email
          networkVolumes { id }
        }
      }
    `
    // Wait, the proper field for balance in runpod graphql is often 'fund' or 'credit' or 'account { balance }', but let's query introspection to find it.
    console.log(key.substring(0, 5))
}
checkBalance()
