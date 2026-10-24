import Parent from './parent';

export default abstract class ListBlock extends Parent {
    abstract meta: { loose: boolean };

    setLoose(loose: boolean) {
        this.meta.loose = loose;
        this.classList = this.classList.filter(name => name !== 'mu-tight-list');
        if (!loose)
            this.classList.push('mu-tight-list');
        this.domNode?.classList.toggle('mu-tight-list', !loose);
    }
}
