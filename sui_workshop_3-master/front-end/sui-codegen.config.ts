import type { SuiCodegenConfig } from '@mysten/codegen';

const config: SuiCodegenConfig = {
	output: './src/contracts',
	packages: [
		{
			package: '@onchain-invoice/core',
			path: '../onchain_invoice',
		},
	],
};

export default config;