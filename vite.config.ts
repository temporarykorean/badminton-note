import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
// Local development stays at '/'. Pages passes configure-pages' actual base path.
// A repository-name fallback supports manual CI builds as well.
const repositoryName=process.env.GITHUB_REPOSITORY?.split('/')[1];
const pagesBase=process.env.GITHUB_ACTIONS==='true'&&repositoryName&&!repositoryName.endsWith('.github.io')?`/${repositoryName}/`:'/';
export default defineConfig({plugins:[react()],base:process.env.VITE_BASE_PATH||pagesBase});
