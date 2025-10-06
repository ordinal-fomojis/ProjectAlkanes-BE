import { InteractiveBrowserCredential } from "@azure/identity"
import { SecretClient } from "@azure/keyvault-secrets"
import { config, set } from '@dotenvx/dotenvx'
import { existsSync, readdirSync } from 'fs'
import { readFile, writeFile } from "fs/promises"
import { NodePlopAPI } from 'plop'
import z from 'zod'

const PRIVATE_KEY_FILE_HEADER = `
#/------------------!DOTENV_PRIVATE_KEYS!-------------------/
#/ private decryption keys. DO NOT commit to source control /
#/     [how it works](https://dotenvx.com/encryption)       /
#/----------------------------------------------------------/

# .env.production
# DOTENV_PRIVATE_KEY_PROD="..."
`.trim()

const environments = readdirSync('env').map(file => file.replace('.env.', '')).filter(x => !x.endsWith('keys'))

export default function (plop: NodePlopAPI) {
  plop.setGenerator('init', {
    description: 'Initialize dotenvx in your project',
    prompts: [
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'A .env file already exists. Do you want to overwrite it?',
        when: () => existsSync('.env')
      }
    ],
    actions: [
      async function init(answers) {
        const vaultName = "shovel-kv"
        const secretName = "DotenvPrivateKeyNonProd"
        const keyFilePath = 'env/.env.keys'
        const defaultEnv = 'dev'
        
        const credential = new InteractiveBrowserCredential({ additionallyAllowedTenants: ['*'] })
        const client = new SecretClient(`https://${vaultName}.vault.azure.net`, credential)
        const privateKey = (await client.getSecret(secretName)).value

        const nonprodEnvs = environments.filter(env => env !== 'prod')
        let message = ''
        if (existsSync(keyFilePath)) {
          let content = await readFile(keyFilePath, 'utf-8')
          for (const env of nonprodEnvs) {
            const name = `DOTENV_PRIVATE_KEY_${env.toUpperCase()}`
            content = content.replace(new RegExp(`^${name}=.*$`, 'm'), `${name}="${privateKey}"`)
          }
          await writeFile(keyFilePath, content)
          message = `Updated private keys in ${keyFilePath}`
        } else {
          const keyValues = nonprodEnvs.map(env => `# .env.${env}\nDOTENV_PRIVATE_KEY_${env.toUpperCase()}="${privateKey}"`).join('\n\n')
          const fileContent = `${PRIVATE_KEY_FILE_HEADER}\n\n${keyValues}`
          await writeFile(keyFilePath, fileContent)
          message = `Created ${keyFilePath} with private keys`
        }

        const devFileContents = await decryptEnvFile(`env/.env.${defaultEnv}`)
        if (answers.overwrite === true || !existsSync('.env')) {
          await writeFile('.env', devFileContents)
          message += ` and created .env from env/.env.${defaultEnv}`
        } else {
          message += ` and did not edit existing .env file`
        }

        return message
      }
    ]
  })

  plop.setGenerator('set-env-variable', {
    description: 'Set a new, or update an existing environment variable',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'secret name'
      },
      ...environments.map(env => [
        {
          type: 'password',
          name: `${env}_value`,
          message: `secret value for ${env}`
        }
      ]).flat()
    ],
    actions: [
      function setVariable(answers) {
        const schema = z.object({ name: z.string() })
        const { name } = schema.parse(answers)
        const formattedName = name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
        for (const env of environments) {
          // WORKAROUND: You do not need the private key to encrypt and env var (it uses public key)
          // However, if you do have a private key set, and it is wrong, it validates the key and fails the command
          // We may have a dummy private key set, as it's part of the template, so to prevent dotenvx trying to
          // validate it, we set the envKeysFile to an invalid file path, so it doesn't try to validate the key
          set(formattedName, answers[`${env}_value`] as string, { path: `env/.env.${env}`, encrypt: true, envKeysFile: '.x' })
        }
        return 'Set environment variable'
      }
    ]
  })

  plop.setGenerator('decrypt-env', {
    prompts: [
      {
        type: 'list',
        name: 'environment',
        message: 'Which environment do you want to decrypt?',
        choices: environments
      }
    ],
    actions: [
      async function decryptEnv(answers) {
        const envFileName = `env/.env.${answers.environment}`
        return `Decrypted ${envFileName}\n\n${await decryptEnvFile(envFileName)}`
      }
    ]
  })
}

async function decryptEnvFile(path: string) {
  const { parsed } = config({ path, quiet: true })

  if (parsed == null) {
    throw new Error(`Failed to parse ${path}`)
  }

  let fileContent = await readFile(path, 'utf-8')
  for (const [key, value] of Object.entries(parsed)) {
    fileContent = fileContent.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}="${value}"`)
  }

  return fileContent
}
