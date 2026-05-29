import plantumlEncoder from 'plantuml-encoder';

export default class Diagram {
    public encodedInput = '';

    /**
     * Builds a Diagram object storing the encoded input value
     */
    static parse(input: string) {
        const diagram = new Diagram();
        diagram.encode(input);

        return diagram;
    }

    /**
     * Encodes a diagram following PlantUML specs, I used `plantuml-encoder` at last.
     *
     * From https://plantuml.com/text-encoding
     * 1. Encoded in UTF-8
     * 2. Compressed using Deflate or Brotli algorithm
     * 3. Re-encoded in ASCII using a transformation close to base64
     */
    encode(value: string) {
        this.encodedInput = plantumlEncoder.encode(value);
    }

    insertImgElement(container: string | HTMLElement) {
        const PLANTUML_URL = 'https://www.plantuml.com/plantuml';
        const div
            = typeof container === 'string'
                ? document.getElementById(container)
                : container;
        if (div === null || !div.tagName)
            throw new Error(`Invalid container: ${container}`);

        const src = `${PLANTUML_URL}/svg/${this.encodedInput}`;

        div.innerHTML = `<img src="${src}" >`;
    }
}
