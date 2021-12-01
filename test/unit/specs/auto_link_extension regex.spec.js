import { inlineRules } from '../../../src/muya/lib/parser/rules'

const www = 1
const http = 2
const email = 3
// full match : matchGroups[0]
// group 1 : matchGroups[1] : www, no http
// group 2 : matchGroups[2] : good http or localhost
// group 3 : matchGroups[3] : @ email
describe('auto_link_extension regex', () => {
  it('http end with :   (http://some.domain.name/path/to/resource: Description of resource.)', () => {
    let [testString, expected] = [
      'http://some.domain.name/path/to/resource: Description of resource.',
      'http://some.domain.name/path/to/resource']
    let matchGroups = inlineRules.auto_link_extension.exec(testString)
    expect(matchGroups[http]).to.equal(expected)
  })
  it('http end with #1856809:   (https://domain.com/questions#1856809: Description of resource.)', () => {
    let [testString, expected] = [
      'https://domain.com/questions#1856809: Description of resource.',
      'https://domain.com/questions#1856809']
    let matchGroups = inlineRules.auto_link_extension.exec(testString)
    expect(matchGroups[http]).to.equal(expected)
  })
  it('www end with :   (www.domain.name/path/to/resource: Description of resource.)', () => {
    let [testString, expected] = [
      'www.domain.name/path/to/resource: Description of resource.',
      'www.domain.name/path/to/resource']
    let matchGroups = inlineRules.auto_link_extension.exec(testString)
    expect(matchGroups[www]).to.equal(expected)
  })
  it('http end with /   (https://www.google.com/)', () => {
    let [testString, expected] = [
      'https://www.google.com/',
      'https://www.google.com/']
    let matchGroups = inlineRules.auto_link_extension.exec(testString)
    expect(matchGroups[http]).to.equal(expected)
  })
  it('www end with /   (www.google.com/)', () => {
    let [testString, expected] = [
      'www.google.com/',
      'www.google.com/']
    let matchGroups = inlineRules.auto_link_extension.exec(testString)
    expect(matchGroups[www]).to.equal(expected)
  })
  it('@ email   (fewfewfwefwef@email.com: fefefef)', () => {
    let [testString, expected] = [
      'fewfewfwefwef@email.com: fefefef',
      'fewfewfwefwef@email.com']
    let matchGroups = inlineRules.auto_link_extension.exec(testString)
    expect(matchGroups[email]).to.equal(expected)
  })
})
