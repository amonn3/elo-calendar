import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from '../../lib/server/auth';
import { LoginForm } from '../../components/login-form';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export default async function LoginPage(){const session=await getSession((await headers()).get('cookie'));if(session)redirect('/');return <LoginForm/>;}
