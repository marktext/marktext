import type { Config } from 'dompurify';
import DOMPurify from 'dompurify';

const { sanitize, isValidAttribute } = DOMPurify();

export { Config, isValidAttribute };

export default sanitize;
