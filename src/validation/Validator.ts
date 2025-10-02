import type {
    ValidationSchema,
    ValidationError,
    ValidationRule,
} from "../types";

export class Validator {
    /**
     * Validate data against a schema
     */
    static validate(
        data: any,
        schema: ValidationSchema,
    ): { valid: boolean; errors: ValidationError[] } {
        const errors: ValidationError[] = [];

        // Handle case where data is null or undefined
        if (data === null || data === undefined) {
            data = {}; // Treat as empty object to proceed with validation
        }

        for (const [field, rules] of Object.entries(schema)) {
            const value = data[field];
            const fieldErrors = this.validateField(field, value, rules);
            errors.push(...fieldErrors);
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Validate a single field
     */
    private static validateField(
        field: string,
        value: any,
        rules: ValidationRule,
        parentField: string = ''
    ): ValidationError[] {
        const errors: ValidationError[] = [];
        const fullField = parentField ? `${parentField}.${field}` : field;

        // Helper to create error with proper field path
        const createError = (message: string): ValidationError => ({
            field: fullField,
            message: message.replace('{field}', fullField)
        });

        // Required check
        if (rules.required && (value === undefined || value === null || value === '')) {
            errors.push(createError('{field} is required'));
            return errors; // Stop validation if required field is missing
        }

        // Skip other validations if value is not provided and not required
        if (value === undefined || value === null || value === '') {
            return errors;
        }

        // Type check
        if (rules.type) {
            const typeError = this.validateType(fullField, value, rules.type);
            if (typeError) {
                errors.push(typeError);
                // If type is wrong, skip further validations
                return errors;
            }
        }

        // Min/Max for numbers
        if (typeof value === "number") {
            if (rules.min !== undefined && value < rules.min) {
                errors.push({
                    field,
                    message: `${field} must be at least ${rules.min}`,
                });
            }
            if (rules.max !== undefined && value > rules.max) {
                errors.push({
                    field,
                    message: `${field} must be at most ${rules.max}`,
                });
            }
        }

        // MinLength/MaxLength for strings and arrays
        if (typeof value === "string" || Array.isArray(value)) {
            const length = value.length;
            if (rules.minLength !== undefined && length < rules.minLength) {
                errors.push({
                    field,
                    message: `${field} must be at least ${rules.minLength} characters`,
                });
            }
            if (rules.maxLength !== undefined && length > rules.maxLength) {
                errors.push({
                    field,
                    message: `${field} must be at most ${rules.maxLength} characters`,
                });
            }
        }

        // Pattern check for strings
        if (rules.pattern && typeof value === "string") {
            if (!rules.pattern.test(value)) {
                errors.push({
                    field,
                    message: `${field} format is invalid`,
                });
            }
        }

        // Enum check
        if (rules.enum && !rules.enum.includes(value)) {
            errors.push(createError(
                `{field} must be one of: ${rules.enum.join(', ')}`
            ));
        }

        // Custom validation
        if (rules.custom) {
            const result = rules.custom(value);
            if (result !== true) {
                errors.push(createError(
                    typeof result === 'string' ? result : '{field} is invalid'
                ));
            }
        }

        // Nested object validation
        if (rules.type === 'object' && rules.schema && value && typeof value === 'object' && !Array.isArray(value)) {
            const nestedErrors = this.validateNestedObject(value, rules.schema, fullField);
            errors.push(...nestedErrors);
        }

        // Array item validation
        if (rules.type === 'array' && rules.schema && Array.isArray(value)) {
            value.forEach((item, index) => {
                const itemErrors = this.validateField(`${field}[${index}]`, item, rules.schema!, fullField);
                errors.push(...itemErrors);
            });
        }

        return errors;
    }

    /**
     * Validate type
     */
    private static validateType(
        field: string,
        value: any,
        type: string | ValidationSchema,
    ): ValidationError | null {
        // Handle nested schema validation
        if (typeof type === 'object') {
            if (value === null || typeof value !== 'object' || Array.isArray(value)) {
                return { field, message: `${field} must be an object` };
            }
            const { errors } = this.validate(value, type);
            return errors.length > 0
                ? { field, message: `${field} contains invalid fields` }
                : null;
        }

        // Handle primitive types
        switch (type) {
            case 'string':
                if (typeof value !== 'string') {
                    return { field, message: `${field} must be a string` };
                }
                break;
            case 'number':
                if (typeof value !== 'number' || isNaN(value)) {
                    return { field, message: `${field} must be a number` };
                }
                break;
            case 'boolean':
                if (typeof value !== 'boolean') {
                    return { field, message: `${field} must be a boolean` };
                }
                break;
            case 'email':
                if (typeof value !== 'string' || !this.isValidEmail(value)) {
                    return { field, message: `${field} must be a valid email` };
                }
                break;
            case 'url':
                if (typeof value !== 'string' || !this.isValidUrl(value)) {
                    return { field, message: `${field} must be a valid URL` };
                }
                break;
            case 'array':
                if (!Array.isArray(value)) {
                    return { field, message: `${field} must be an array` };
                }
                break;
            case 'object':
                if (value === null || typeof value !== 'object' || Array.isArray(value)) {
                    return { field, message: `${field} must be an object` };
                }
                break;
            default:
                return { field, message: `Unknown type: ${type}` };
        }
        return null;
    }

    /**
     * Validate nested object properties
     */
    private static validateNestedObject(
        obj: Record<string, any>,
        schema: ValidationSchema,
        parentField: string = ''
    ): ValidationError[] {
        const errors: ValidationError[] = [];

        // Validate existing properties
        for (const [key, value] of Object.entries(obj)) {
            const rule = schema[key];
            if (rule) {
                const fieldErrors = this.validateField(key, value, rule, parentField);
                errors.push(...fieldErrors);
            }
        }

        // Check for required fields that are missing
        for (const [key, rule] of Object.entries(schema)) {
            if (rule.required && !(key in obj)) {
                const fullField = parentField ? `${parentField}.${key}` : key;
                errors.push({
                    field: fullField,
                    message: `${fullField} is required`
                });
            }
        }

        return errors;
    }

    /**
     * Check if email is valid
     */
    private static isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Check if URL is valid
     */
    private static isValidUrl(url: string): boolean {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
}
