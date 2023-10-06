import { JsonSchemaValidators } from './types';
import { memo } from './utils';

/** This simply memoizes the result to prevent over fetching */
export class AugmentedSchemaValidators implements JsonSchemaValidators {
  constructor(private schemaValidators: JsonSchemaValidators) {}
  public isAugmented = true;
  validateSectionSchema = memo(async () => await this.schemaValidators.validateSectionSchema());
}
