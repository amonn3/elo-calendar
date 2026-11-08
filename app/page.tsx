import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from '../lib/server/auth';
import CalendarApp from '../components/calendar-app';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export default async function Home(){
 const session=await getSession((await headers()).get('cookie'));
 if(!session)redirect('/login');
 return <CalendarApp user={session.user}/>;
}
