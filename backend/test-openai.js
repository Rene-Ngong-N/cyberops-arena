
import 'dotenv/config'
import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

async function testOpenAI() {
  try {
    console.log('Generating cybersecurity incident...')

    const response = await client.responses.create({
      model: 'gpt-4.1-mini',
      instructions: `You are a cybersecurity incident-response
        trainer. Create realistic, educational cloud security
        challenges. Keep your answers concise.`,
      input: `Generate one AWS cybersecurity incident with:
        1. A realistic incident scenario
        2. Three possible response actions labeled A, B, C
        3. The correct answer
        4. A short explanation of why it is correct.`,
      max_output_tokens: 350
    })

    console.log('\n=== AI-GENERATED INCIDENT ===\n')
    console.log(response.output_text)
  } catch (error) {
    console.error('OpenAI request failed:', error.message)
  }
}

testOpenAI()
