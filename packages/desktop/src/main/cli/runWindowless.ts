import path from 'path'
import fsPromises from 'fs/promises'
import type { CliJob } from './cliJob'
import { finishCliJob, markCliOutputWritten } from './cliJob'
import { writeFile } from '../filesystem'
import pandoc, { getPandocReader } from '../utils/pandoc'

/**
 * Run a windowless CLI job (`--import`, `--export <format>`): pandoc converts
 * between document formats without any rendering, so no window is created and
 * no MarkText instance conflict can occur.
 */
export const runWindowlessCliJob = async(job: CliJob): Promise<void> => {
  if (!(await pandoc.exists())) {
    finishCliJob(
      1,
      'marktext: pandoc not found; install pandoc or point MARKTEXT_PANDOC at the binary'
    )
    return
  }

  try {
    for (let i = 0; i < job.inputs.length; ++i) {
      const input = job.inputs[i]
      const output = job.outputs[i]
      await fsPromises.mkdir(path.dirname(output), { recursive: true })

      if (job.kind === 'import') {
        // pandoc auto-detects the source format from the file extension.
        const markdown = await pandoc(input, 'markdown')
        await writeFile(output, markdown, '.md', 'utf-8')
      } else {
        // Validated by prepareCliJob: pandoc exports always carry a format.
        const format = job.format
        if (!format) throw new Error('internal: pandoc export without a format')
        const markdown = await fsPromises.readFile(input, 'utf-8')
        const { warnings } = await pandoc.toFile(format.target, output, markdown, {
          // Relative image links resolve against the document's folder.
          cwd: path.dirname(input),
          metadata: { title: path.basename(input, path.extname(input)) },
          reader: getPandocReader({ superSubScript: false })
        })
        if (warnings) process.stderr.write(warnings + '\n')
      }
      markCliOutputWritten(input, output)
    }
    finishCliJob(0)
  } catch (err) {
    const message = (err instanceof Error && err.message) || String(err)
    finishCliJob(1, `marktext: ${message}`)
  }
}
