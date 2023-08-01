import Ajv from 'ajv';
import * as fs from 'fs';
import * as path from 'path';
import standaloneCode from 'ajv/dist/standalone';

/**
 * Attempts to compile all the json schemas within a directory
 *
 * All compatible schemas will be output to the same directory
 */
export const compileJsonSchemaToFile = async (dir: string) => {
  const ajv = new Ajv({ code: { source: true }, strict: false });

  // Read the directory
  fs.readdir(dir, (err, files) => {
    if (err) {
      console.error(`Error reading directory: ${err}`);
      return;
    }

    // Filter JSON schema files by naming convention in theme-check-liquid
    const schemaFiles = files.filter((file) => file.endsWith('_schema.json'));

    schemaFiles.forEach((file) => {
      const filePath = path.join(dir, file);

      // Read and parse each JSON schema
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          console.error(`Error reading file: ${err}`);
          return;
        }

        const schema = JSON.parse(data);

        // Compile the schema to a validation function and generate the code
        const validate = ajv.compile(schema);
        const moduleCode = standaloneCode(ajv, validate);

        // Write the module code to file
        const outputPath = path.join(dir, `${path.basename(file, '.json')}_validator.js`);
        fs.writeFileSync(outputPath, moduleCode);
      });
    });
  });
};

export const compileJsonSchema = (jsonSchema: any) => {
  const ajv = new Ajv({ strict: false });

  return ajv.compile(jsonSchema);
};
