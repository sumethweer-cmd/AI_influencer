import axios from 'axios'
import fs from 'fs'
import path from 'path'

/**
 * Phase 2: ComfyUI API Connector
 * This library interacts with the ComfyUI instance running on the Runpod.
 */
export class ComfyUIClient {
    private baseUrl: string

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
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
    async waitForImage(promptId: string): Promise<any[]> {
        const historyUrl = `${this.baseUrl}/history/${promptId}`

        // Polling every 5 seconds
        while (true) {
            try {
                const resp = await axios.get(historyUrl)
                const data = resp.data[promptId]

                if (data && data.outputs) {
                    // Extract filenames from all image outputs
                    const images: any[] = []

                    // Instead of blindly grabbing all images from all nodes:
                    for (const nodeId in data.outputs) {
                        const nodeOutput = data.outputs[nodeId]

                        // Check if this node output contains images
                        if (nodeOutput.images && Array.isArray(nodeOutput.images)) {
                            // Filter images: In ComfyUI, SaveImage nodes often put the image type as 'output'
                            // PreviewImage or intermediate nodes might have different types or we want to filter them
                            // Since we don't always know the exact node ID of the final SaveImage, 
                            // a robust way is to look for images of type 'output' (which usually means they were saved to disk)
                            const outputImages = nodeOutput.images.filter((img: any) => img.type === 'output')
                            if (outputImages.length > 0) {
                                images.push(...outputImages)
                            }
                        }
                    }

                    // Fallback: If no 'output' type found (maybe they only had temp/preview), grab ALL images from all nodes
                    if (images.length === 0 && Object.keys(data.outputs).length > 0) {
                        for (const nodeId in data.outputs) {
                            if (data.outputs[nodeId].images) {
                                images.push(...data.outputs[nodeId].images);
                            }
                        }
                    }

                    if (images.length > 0) return images

                    // If job is finished and in history but no images produced, do not loop forever
                    if (Object.keys(data.outputs).length > 0 || (data.status && data.status.completed)) {
                        return images // returns []
                    }
                }

                // Check if the job explicitly failed
                if (data && data.status && data.status.status_str === 'error') {
                    throw new Error('ComfyUI Job Failed: ' + (data.status.messages ? JSON.stringify(data.status.messages) : 'Unknown error'))
                }
            } catch (err: any) {
                // If 404, it means the job hasn't finished and isn't in history yet.
                // We just swallow the error and keep polling.
            }

            await new Promise(resolve => setTimeout(resolve, 5000))
        }
    }

    /**
     * Download image from ComfyUI as a Buffer
     */
    async downloadImageAsBuffer(image: any): Promise<Buffer> {
        let url = `${this.baseUrl}/view?filename=`
        if (typeof image === 'string') {
            url += encodeURIComponent(image)
        } else {
            url += `${encodeURIComponent(image.filename)}&subfolder=${encodeURIComponent(image.subfolder || '')}&type=${encodeURIComponent(image.type || 'output')}`
        }

        const response = await axios.get(url, { responseType: 'arraybuffer' })
        return Buffer.from(response.data)
    }

    /**
     * Upload an image to ComfyUI input folder from a Public URL
     */
    async uploadImageFromUrl(imageUrl: string, filename: string) {
        // Fetch the image from the URL (e.g. Supabase Public URL)
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' })
        const fileBuffer = Buffer.from(imageResponse.data)

        const url = `${this.baseUrl}/upload/image`
        const formData = new FormData()

        const blob = new Blob([fileBuffer])
        formData.append('image', blob, filename)
        formData.append('overwrite', 'true')

        try {
            const response = await axios.post(url, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            return response.data
        } catch (err: any) {
            console.error('ComfyUI Upload Failed:', err.message)
            throw err
        }
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
