import type { Icon, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

// OAuth endpoints and scopes of the CareClinic public API gateway (api.careclinic.io).
// Scope names come from careclinic_mcp_internal src/domain.ts (READ_SCOPE, WRITE_SCOPES).
// This node reads sleep but does not create sleep entries, so careclinic.sleep.write is not requested.
export class CareClinicOAuth2Api implements ICredentialType {
	name = 'careClinicOAuth2Api';

	extends = ['oAuth2Api'];

	displayName = 'CareClinic OAuth2 API';

	icon: Icon = { light: 'file:../icons/careclinic.svg', dark: 'file:../icons/careclinic.svg' };

	documentationUrl = 'https://github.com/tandemloop/n8n-nodes-careclinic#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Grant Type',
			name: 'grantType',
			type: 'hidden',
			default: 'authorizationCode',
		},
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'hidden',
			default: 'https://api.careclinic.io/oauth/authorize',
			required: true,
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default: 'https://api.careclinic.io/oauth/token',
			required: true,
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'hidden',
			default:
				'careclinic.wellness.read careclinic.symptoms.write careclinic.mood.write careclinic.medications.write',
		},
		{
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden',
			default: '',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'header',
		},
	];

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.careclinic.io/v1',
			url: '/me',
			method: 'GET',
		},
	};
}
