import { JsonValidationSet } from './types';
import { memo } from './utils';

/** This simply memoizes the result to prevent over fetching */
export class AugmentedJsonValidationSet implements JsonValidationSet {
  constructor(private schemaValidators: JsonValidationSet) {}
  public isAugmented = true;
  sectionSchema = memo(async () => await this.schemaValidators.sectionSchema());
  translationSchema = memo(async () => await this.schemaValidators.translationSchema());
  validateSectionSchema = memo(async () => await this.schemaValidators.validateSectionSchema());
}
