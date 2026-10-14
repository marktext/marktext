# README current sponsors

The `Update current sponsors` workflow updates the avatar wall below Special
Sponsor every day, or on manual dispatch. It reads active, public sponsorships
for the `marktext` organization through GitHub GraphQL, including every page.
All avatars link to <https://github.com/sponsors/marktext>. An empty list removes
the heading and avatar wall. API failures leave the README unchanged.

## Setup

1. Create a GitHub personal access token that can read the organization's
   sponsorships. A classic token with `read:user` and `read:org` is a starting
   point; authorize it for organization SSO if required.
2. Add the token as the repository Actions secret `SPONSORS_TOKEN`.
3. Merge the workflow and script into the repository's default branch, then run
   `Update current sponsors` from the Actions tab for the initial sync.
4. Ensure branch rules allow `github-actions[bot]` to push README updates. The
   workflow uses `GITHUB_TOKEN` with `contents: write` for commits, separately
   from the token used to read sponsorships.

Only the content between the `current-sponsors` markers is managed automatically.
Special Sponsor remains independently maintained.

To run locally with `SPONSORS_TOKEN` already set in the environment:

```bash
node scripts/update-current-sponsors.mjs
```

API reference: [GitHub Sponsors GraphQL](https://docs.github.com/en/graphql/reference/sponsors).
