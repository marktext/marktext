import type { BeginRuleToken, ReferenceDefinitionToken } from '../model/types';
import type { IBlockProfile } from './profiles';
import type { IInlineFeatures } from './types';
import { isLengthEven } from '../../utils';
import { parseReferenceDefinition } from '../referenceDefinitions';
import { beginRules } from './rules';

export type PrefixMatch = Omit<BeginRuleToken, 'parent' | 'range'> | Omit<ReferenceDefinitionToken, 'parent' | 'range'>;

export function matchPrefix(source: string, profile: IBlockProfile, features: IInlineFeatures): PrefixMatch | null {
    for (const type of profile.prefixRules) {
        if (type === 'multiple_math' && !features.texMathDollars)
            continue;
        const match = beginRules[type].exec(source);
        if (!match)
            continue;
        // Fence alternatives use different capture groups for their marker and info string.
        const parts = type === 'code_fence'
            ? { marker: match[1] || match[3], content: match[2] || match[4] || '', backlash: '' }
            : { marker: match[1], content: match[2] || '', backlash: match[3] || '' };
        return { type, raw: match[0], ...parts };
    }
    const definition = profile.referenceDefinitions ? parseReferenceDefinition(source) : null;
    return definition && isLengthEven(definition.backlash)
        ? { ...definition, type: 'reference_definition' }
        : null;
}
