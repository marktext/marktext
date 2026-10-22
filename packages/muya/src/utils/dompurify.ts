import type { Config, DOMPurify as IDOMPurify } from 'dompurify';
import DOMPurify from 'dompurify';

const purifier = DOMPurify();

// Naming the method type keeps the emitted declaration from reaching into
// `@types/trusted-types` for the TrustedHTML overloads, which it cannot
// reference from outside the package (TS2883).
const sanitize: IDOMPurify['sanitize'] = purifier.sanitize;
const { addHook, isValidAttribute, removeHook } = purifier;

export { addHook, Config, isValidAttribute, removeHook };

export default sanitize;
