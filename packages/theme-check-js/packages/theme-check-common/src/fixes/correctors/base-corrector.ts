import { Fix } from '../../types';

export interface BaseCorrector {
  get fix(): Fix;
}
