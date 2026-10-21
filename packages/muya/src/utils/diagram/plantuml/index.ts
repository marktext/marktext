import plantumlEncoder from 'plantuml-encoder';

const PLANTUML_DEFAULT_URL = 'https://www.plantuml.com/plantuml';

export default class Diagram {
    public encodedInput = '';
    public plantumlServer = PLANTUML_DEFAULT_URL;

    static parse(input: string, plantumlServer?: string) {
        const diagram = new Diagram();
        diagram._encode(input);
        if (plantumlServer)
            diagram.plantumlServer = plantumlServer;

        return diagram;
    }

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
