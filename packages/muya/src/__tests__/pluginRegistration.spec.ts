// @vitest-environment happy-dom

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

let originalPlugins: typeof Muya.plugins;

beforeEach(() => {
    originalPlugins = Muya.plugins;
    Muya.plugins = [];
});

afterEach(() => {
    Muya.plugins = originalPlugins;
});

it('creates and destroys one tool per plugin name using the latest registration', () => {
    const created = vi.fn();
    const destroyed = vi.fn();
    class ImageTool {
        static pluginName = 'imageSelector';

        constructor(_muya: Muya, options: Record<string, unknown>) {
            created(options);
        }

        destroy() {
            destroyed();
        }
    }

    Muya.use(ImageTool, {
        imagePathPicker: 'old',
    });
    class UpdatedImageTool extends ImageTool {}
    const imagePathPicker = vi.fn();
    Muya.use(UpdatedImageTool, {
        imagePathPicker,
    });
    Muya.use(UpdatedImageTool, {
        imagePathPicker,
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, {
        markdown: '\n',
    });
    try {
        muya.init();
        expect(created).toHaveBeenCalledExactlyOnceWith({
            imagePathPicker,
        });
    }
    finally {
        muya.destroy();
    }
    expect(destroyed).toHaveBeenCalledTimes(1);
});
