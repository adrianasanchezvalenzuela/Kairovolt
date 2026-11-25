/** Une clases CSS ignorando valores vacíos. */
export const cx = (...clases: (string | false | null | undefined)[]): string => clases.filter(Boolean).join(' ');
