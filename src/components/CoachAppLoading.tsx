import PlayFootyLoadingScreen from './PlayFootyLoadingScreen'

type Props={message?:string}

export default function CoachAppLoading({message='Opening your team…'}:Props){
 return <PlayFootyLoadingScreen message={message}/>
}
