import axios from 'axios'
import fs from 'fs'
import path from 'path'

/**
 * Phase 2: ComfyUI API Connector
 * This library interacts with the ComfyUI instance running on the Runpod.
 */
export class ComfyUIClient {
    private baseUrl: string

    constructor(host: string, port: number = 8188) {
        this.baseUrl = `http://${host}:${port}`
    }

    /**
     * Send a prompt (workflow JSON) to ComfyUI
     */
    async queuePrompt(workflow: any) {
        const url = `${this.baseUrl}/prompt`
        const client_id = 'nong_kung_agency'

        try {
            const response = await axios.post(url, {
                prompt: workflow,
                client_id
            })
            return response.data.prompt_id
        } catch (err: any) {
            console.error('ComfyUI Prompt Failed:', err.message)
            throw err
        }
    }

    /**
     * Wait for a job to finish and get the image filename
     */
    async waitForImage(promptId: string): Promise<string[]> {
        const historyUrl = `${this.baseUrl}/history/${promptId}`

        // Polling every 5 seconds
        while (true) {
            const resp = await axios.get(historyUrl)
            const data = resp.data[promptId]

            if (data && data.outputs) {
                // Extract filenames from all image outputs
                const images: string[] = []
                for (const nodeId in data.outputs) {
                    if (data.outputs[nodeId].images) {
                        images.push(...data.outputs[nodeId].images.map((img: any) => img.filename))
                    }
                }
                return images
            }

            await new Promise(resolve => setTimeout(resolve, 5000))
        }
    }

    /**
     * Download image from ComfyUI to local storage
     */
    async downloadImage(filename: string, localPath: string) {
        const url = `${this.baseUrl}/view?filename=${filename}`
        const response = await axios.get(url, { responseType: 'stream' })

        const dir = path.dirname(localPath)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

        const writer = fs.createWriteStream(localPath)
        response.data.pipe(writer)

        return new Promise<void>((resolve, reject) => {
            writer.on('finish', () => resolve())
            writer.on('error', reject)
        })
    }

    /**
     * Helper: Check if ComfyUI is ready
     */
    async isReady() {
        try {
            await axios.get(`${this.baseUrl}/system_stats`, { timeout: 2000 })
            return true
        } catch {
            return false
        }
    }
}
