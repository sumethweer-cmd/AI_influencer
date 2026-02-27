import axios from 'axios'
import { RunpodPod } from '@/types'
import { getConfig } from './config'

/**
 * Helper to get an authenticated Axios instance for Runpod
 */
const getApi = async () => {
  const key = await getConfig('RUNPOD_API_KEY')
  return axios.create({
    baseURL: 'https://api.runpod.io/graphql',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }
  })
}

/**
 * Phase 2: Deploy a Pod using the specific template
 */
export async function deployPod(name: string): Promise<string> {
  const templateId = await getConfig('RUNPOD_TEMPLATE_ID') || 'new Template V.2'
  const volumeId = await getConfig('RUNPOD_NETWORK_VOLUME_ID')
  console.log(`Deploying Runpod: ${name} using ${templateId}${volumeId ? ` with Volume ${volumeId}` : ''}...`)

  const volumeInput = volumeId ? `networkVolumeId: "${volumeId}",` : ''

  const query = `
    mutation {
      podFindAndDeployOnDemand(
        input: {
          cloudType: ALL,
          gpuCount: 1,
          gpuTypeId: "NVIDIA GeForce RTX 4090",
          name: "${name}",
          imageName: "runpod/stable-diffusion:v1",
          templateId: "${templateId}",
          ${volumeInput}
          volumeInGb: 0,
          containerDiskInGb: 20
        }
      ) {
        id
        imageName
        machineId
      }
    }
  `

  try {
    const api = await getApi()
    const response = await api.post('', { query })
    const podId = response.data.data.podFindAndDeployOnDemand.id
    console.log('Pod deployed successfully. ID:', podId)
    return podId
  } catch (err) {
    console.error('Runpod Deployment Failed:', err)
    throw err
  }
}

/**
 * Phase 2: Terminate a Pod to save costs
 */
export async function terminatePod(podId: string) {
  console.log(`Terminating Pod: ${podId}...`)

  const query = `
    mutation {
      podTerminate(input: {podId: "${podId}"})
    }
  `

  try {
    const api = await getApi()
    await api.post('', { query })
    console.log('Pod terminated successfully.')
  } catch (err) {
    console.error('Runpod Termination Failed:', err)
  }
}

/**
 * Get pod details (IP, Port, Status)
 */
export async function getPodDetails(podId: string): Promise<RunpodPod> {
  const query = `
    query {
      pod(input: {podId: "${podId}"}) {
        id
        name
        runtime {
          gpus { id }
          ports {
            isPublic
            ip
            privatePort
            publicPort
          }
        }
      }
    }
  `

  const api = await getApi()
  const response = await api.post('', { query })
  return response.data.data.pod
}

/**
 * Poll the Pod until the ComfyUI API on port 8188 is responsive
 */
export async function waitForComfyUI(podId: string, maxRetries = 30, delayMs = 10000): Promise<string> {
  console.log(`Waiting for ComfyUI to boot on Pod: ${podId}...`)

  for (let i = 0; i < maxRetries; i++) {
    try {
      // Get the current pod details
      const pod = await getPodDetails(podId)

      // Look for port 8188
      // @ts-ignore
      const port8188 = pod.runtime?.ports?.find(p => p.privatePort === 8188)
      if (port8188 && port8188.ip && port8188.publicPort) {
        const comfyUrl = `http://${port8188.ip}:${port8188.publicPort}`

        // Try to ping the ComfyUI system stats endpoint
        try {
          // If we can reach /system_stats, ComfyUI is fully booted and ready
          await axios.get(`${comfyUrl}/system_stats`, { timeout: 3000 })
          console.log(`ComfyUI is READY at ${comfyUrl}`)
          return comfyUrl
        } catch (pingError) {
          console.log(`[Attempt ${i + 1}/${maxRetries}] Port exposed, but ComfyUI not serving yet...`)
        }
      } else {
        console.log(`[Attempt ${i + 1}/${maxRetries}] Pod booting, port 8188 not available yet...`)
      }
    } catch (err) {
      console.log(`[Attempt ${i + 1}/${maxRetries}] Error fetching pod details...`)
    }

    // Wait before next retry
    await new Promise(r => setTimeout(r, delayMs))
  }

  throw new Error('ComfyUI failed to start within the timeout period')
}
