import { describe, expect, it } from 'vitest';
import Diagram from '../index';

const TEST_SOURCE = '@startuml\nA -> B\n@enduml';

describe('plantuml Diagram', () => {
    it('uses the default server URL when none is provided', () => {
        const diagram = Diagram.parse(TEST_SOURCE);
        expect(diagram.plantumlServer).toBe('https://www.plantuml.com/plantuml');
    });

    it('uses the custom server URL when provided', () => {
        const customUrl = 'http://localhost:8080/plantuml';
        const diagram = Diagram.parse(TEST_SOURCE, customUrl);
        expect(diagram.plantumlServer).toBe(customUrl);
    });

    it('falls back to default when custom URL is empty', () => {
        const diagram = Diagram.parse(TEST_SOURCE, '');
        expect(diagram.plantumlServer).toBe('https://www.plantuml.com/plantuml');
    });

    it('encodes input to a non-empty string', () => {
        const diagram = Diagram.parse(TEST_SOURCE);
        expect(diagram.encodedInput).toBeTruthy();
        expect(typeof diagram.encodedInput).toBe('string');
    });
});
