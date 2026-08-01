import type { ApiErrorDetail } from '@agencyflow/contracts';
import type { ValidationError } from 'class-validator';

import { ValidationFailedException } from '../exceptions/domain.exception';
import { fr } from '../../i18n/fr';

/**
 * Turns class-validator output into the agreed error envelope.
 *
 * Nest's default puts every failure into a flat `message: string[]`, which a
 * form cannot use: it has no idea which input to mark red. Flattening to
 * `{ field, message }` pairs is what lets the React form attach each message
 * to its own field (09-Frontend-Design.md section 5).
 *
 * Nested DTOs are walked recursively and reported with a dotted path, so a
 * failure inside an embedded object is still addressable.
 */
function flatten(errors: ValidationError[], parentPath = ''): ApiErrorDetail[] {
  return errors.flatMap((error) => {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;

    const own = Object.values(error.constraints ?? {}).map((message) => ({ field: path, message }));
    const nested = error.children?.length ? flatten(error.children, path) : [];

    return [...own, ...nested];
  });
}

export function validationExceptionFactory(errors: ValidationError[]): ValidationFailedException {
  return new ValidationFailedException(fr.common.validationFailed, flatten(errors));
}
