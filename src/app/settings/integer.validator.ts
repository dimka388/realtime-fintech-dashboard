import {
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';

export const integerValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value: unknown = control.value;

  // Empty values are handled by Validators.required.
  if (value === null || value === '') {
    return null;
  }

  return typeof value === 'number' &&
    Number.isInteger(value)
    ? null
    : {
        integer: true,
      };
};
