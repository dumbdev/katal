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
    ): ValidationError[] {
        const errors: ValidationError[] = [];

        // Required check
        if (
            rules.required &&
            (value === undefined || value === null || value === "")
        ) {
            errors.push({
                field,
                message: `${field} is required`,
            });
            return errors; // Stop validation if required field is missing
        }

        // Skip other validations if value is not provided and not required
        if (value === undefined || value === null) {
            return errors;
        }

        // Type check
        if (rules.type) {
            const typeError = this.validateType(field, value, rules.type);
            if (typeError) errors.push(typeError);
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
            errors.push({
                field,
                message: `${field} must be one of: ${rules.enum.join(", ")}`,
            });
        }

        // Custom validation
        if (rules.custom) {
            const result = rules.custom(value);
            if (result !== true) {
                errors.push({
                    field,
                    message:
                        typeof result === "string"
                            ? result
                            : `${field} is invalid`,
                });
            }
        }

        return errors;
    }

    /**
     * Validate type
     */
    private static validateType(
        field: string,
        value: any,
        type: string,
    ): ValidationError | null {
        switch (type) {
            case "string":
                if (typeof value !== "string") {
                    return { field, message: `${field} must be a string` };
                }
                break;
            case "number":
                if (typeof value !== "number" || isNaN(value)) {
                    return { field, message: `${field} must be a number` };
                }
                break;
            case "boolean":
                if (typeof value !== "boolean") {
                    return { field, message: `${field} must be a boolean` };
                }
                break;
            case "email":
                if (typeof value !== "string" || !this.isValidEmail(value)) {
                    return { field, message: `${field} must be a valid email` };
                }
                break;
            case "url":
                if (typeof value !== "string" || !this.isValidUrl(value)) {
                    return { field, message: `${field} must be a valid URL` };
                }
                break;
            case "array":
                if (!Array.isArray(value)) {
                    return { field, message: `${field} must be an array` };
                }
                break;
            case "object":
                if (typeof value !== "object" || Array.isArray(value)) {
                    return { field, message: `${field} must be an object` };
                }
                break;
        }
        return null;
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
