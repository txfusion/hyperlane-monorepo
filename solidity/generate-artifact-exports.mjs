import { promises as fs } from 'fs';
import { basename, dirname, join } from 'path';
import { glob } from 'typechain';
import { fileURLToPath } from 'url';

const cwd = process.cwd();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT_OUTPUT_DIR = join(__dirname, 'core-utils/zksync/');
const ARTIFACTS_OUTPUT_DIR = join(ROOT_OUTPUT_DIR, 'artifacts');

/**
 * @notice Templates for TypeScript artifact generation
 */
const TEMPLATES = {
  ARTIFACT: `\
import type { ZKSyncContractArtifact } from '../types.js';

export const {name}: ZKSyncContractArtifact = {artifact} as const;
`,

  ARTIFACT_INDEX: `\
import type { ZKSyncContractArtifact } from './types.js';

{imports}

export const zkSyncContractArtifacts : ZKSyncContractArtifact[] = [
{exports}
] as const;
`,
};

class ArtifactGenerator {
  constructor() {
    this.processedFiles = new Set();
  }

  /**
   * @notice Retrieves paths of all relevant artifact files
   * @dev Excludes debug files and build-info directory
   * @return {string[]} Array of file paths matching the glob pattern
   */
  getArtifactPaths() {
    return glob(cwd, [
      `!./artifacts-zk/!(build-info)/**/*.dbg.json`,
      `./artifacts-zk/!(build-info)/**/+([a-zA-Z0-9_]).json`,
    ]);
  }

  /**
   * @notice Creates the output directory if it doesn't exist
   */
  async createOutputDirectory() {
    await fs.mkdir(ARTIFACTS_OUTPUT_DIR, { recursive: true });
  }

  /**
   * @notice Reads and parses a JSON artifact file
   * @param filePath Path to the artifact file
   * @return {Promise<Object>} Parsed JSON content
   */
  async readArtifactFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * @notice Generates TypeScript content for a contract artifact
   * @param name Name of the artifact (contract name)
   * @param artifact The artifact object (typeof ZKSyncContractArtifact)
   * @return {string} Generated TypeScript content
   */
  generateTypeScriptContent(name, artifact) {
    return TEMPLATES.ARTIFACT.replace('{name}', name).replace(
      '{artifact}',
      JSON.stringify(artifact, null, 2),
    );
  }

  /**
   * @notice Generates index file content with imports and exports
   * @param artifactNames Array of processed artifact names
   * @return {string} Generated index file content
   */
  generateIndexContent(artifactNames) {
    const imports = artifactNames
      .map((name) => `import { ${name} } from './artifacts/${name}.js';`)
      .join('\n');

    const exports = artifactNames.map((name) => `  ${name},`).join('\n');

    return TEMPLATES.ARTIFACT_INDEX.replace('{imports}', imports).replace(
      '{exports}',
      exports,
    );
  }

  /**
   * @notice Processes a single artifact file
   * @dev Skips already processed files to avoid duplicates
   * @param filePath Path to the artifact file
   */
  async processArtifact(filePath) {
    const name = basename(filePath, '.json');

    if (this.processedFiles.has(name)) {
      return;
    }

    const artifact = await this.readArtifactFile(filePath);
    const tsContent = this.generateTypeScriptContent(name, artifact);
    await fs.writeFile(join(ARTIFACTS_OUTPUT_DIR, `${name}.ts`), tsContent);

    this.processedFiles.add(name);
  }

  /**
   * @dev Processes all artifacts and generates index file
   */
  async generate() {
    try {
      await this.createOutputDirectory();

      const artifactPaths = this.getArtifactPaths();

      for (const filePath of artifactPaths) {
        await this.processArtifact(filePath);
      }

      const processedNames = Array.from(this.processedFiles);

      // Generate and write artifacts index file
      const indexContent = this.generateIndexContent(processedNames);
      await fs.writeFile(join(ROOT_OUTPUT_DIR, 'artifacts.ts'), indexContent);

      console.log(
        `✅ Successfully processed ${processedNames.length} zksync artifacts`,
      );
    } catch (error) {
      console.error('❌ Error processing zksync artifacts:', error);
      throw error;
    }
  }
}

const generator = new ArtifactGenerator();
generator.generate().catch(console.error);
