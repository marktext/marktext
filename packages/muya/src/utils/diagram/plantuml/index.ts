import plantumlEncoder from 'plantuml-encoder';

const PLANTUML_DEFAULT_URL = 'https://www.plantuml.com/plantuml';

export default class Diagram {
    public encodedInput = '';
    public plantumlServer = PLANTUML_DEFAULT_URL;

    /**
     * Builds a Diagram object storing the encoded input value
     */
    static parse(input: string, plantumlServer?: string) {
        const diagram = new Diagram();
        diagram._encode(input);
        if (plantumlServer)
            diagram.plantumlServer = plantumlServer;

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
    private _encode(value: string) {
        this.encodedInput = plantumlEncoder.encode(value);
    }

    insertImgElement(container: string | HTMLElement) {
        const div
            = typeof container === 'string'
                ? document.getElementById(container)
                : container;
        if (div === null || !div.tagName)
            throw new Error(`Invalid container: ${container}`);

        const src = `${this.plantumlServer}/svg/${this.encodedInput}`;

        div.innerHTML = `<img src="${src}" >`;
    }
}
