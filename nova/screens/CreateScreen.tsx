import React, { useState, useCallback } from 'react';
import { useAuth } from '../App';
import { Role } from '../types';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { uploadMedia } from '../utils/firebaseUtils';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ArrowLeftIcon, PhotoIcon, VideoIcon, MegaphoneIcon } from '../components/icons';

interface CreateScreenProps {
    onPostCreated: () => void;
}

const CreateOption: React.FC<{label: string, icon: React.ReactNode, onClick: () => void}> = ({label, icon, onClick}) => (
    <button onClick={onClick} className="w-full text-left p-4 flex items-center space-x-4 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">{icon}</div>
        <span className="font-semibold text-lg">{label}</span>
        <span className="ml-auto text-gray-400">&rarr;</span>
    </button>
)

const FormInput: React.FC<{label: string, value: string, onChange: (val: string) => void, placeholder: string, type?: string, required?: boolean}> = 
    ({label, value, onChange, placeholder, type = 'text', required = false}) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} 
            className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" required={required} />
    </div>
);

const FormTextArea: React.FC<{label: string, value: string, onChange: (val: string) => void, placeholder: string, required?: boolean}> =
    ({label, value, onChange, placeholder, required = false}) => (
    <div>
         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={5}
            className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" required={required} />
    </div>
);


const CreateScreen: React.FC<CreateScreenProps> = ({ onPostCreated }) => {
    const { userProfile } = useAuth();
    const [createType, setCreateType] = useState<'post' | 'campaign' | 'story' | null>(null);

    const handleBack = () => setCreateType(null);
    const handleSuccess = () => {
        setCreateType(null);
        onPostCreated();
    };

    if (createType === 'post') return <CreateMediaForm onBack={handleBack} onSuccess={handleSuccess} />;
    if (createType === 'story') return <CreateStoryForm onBack={handleBack} onSuccess={handleSuccess} />;
    if (createType === 'campaign') return <CreateCampaignForm onBack={handleBack} onSuccess={handleSuccess} />;

    return (
        <div className="p-4">
            <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">Create</h1>
            <div className="space-y-3">
                {userProfile?.role === Role.INFLUENCER && (
                    <>
                        <CreateOption onClick={() => setCreateType('post')} label="Post" icon={<PhotoIcon className="h-6 w-6 text-gray-600 dark:text-gray-300"/>} />
                        <CreateOption onClick={() => setCreateType('story')} label="Story" icon={<VideoIcon className="h-6 w-6 text-gray-600 dark:text-gray-300"/>} />
                    </>
                )}
                {userProfile?.role === Role.BRAND && (
                    <>
                         <CreateOption onClick={() => setCreateType('campaign')} label="Campaign" icon={<MegaphoneIcon className="h-6 w-6 text-gray-600 dark:text-gray-300"/>}/>
                         <CreateOption onClick={() => setCreateType('post')} label="Brand Post" icon={<PhotoIcon className="h-6 w-6 text-gray-600 dark:text-gray-300"/>} />
                    </>
                )}
            </div>
        </div>
    );
};

const CreateMediaForm: React.FC<{ onBack: () => void; onSuccess: () => void; }> = ({ onBack, onSuccess }) => {
    const { user } = useAuth();
    const [caption, setCaption] = useState('');
    const [media, setMedia] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const mediaType = media?.type.startsWith('video/') ? 'video' : 'image';

    const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 25 * 1024 * 1024) { // 25MB limit
                setError('File is too large. Max size is 25MB.');
                return;
            }
            setError('');
            setMedia(file);
            setPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!media || !user) return;
        
        setLoading(true);
        setError('');

        try {
            const { url: mediaUrl, resource_type, public_id: mediaPublicId } = await uploadMedia(media, user.uid, 'post');
            await addDoc(collection(db, 'posts'), {
                userId: user.uid,
                caption,
                mediaUrl,
                mediaPublicId,
                mediaType: resource_type,
                likes: [],
                comments: [],
                createdAt: serverTimestamp(),
            });
            onSuccess();
        } catch (error: any) {
            console.error(`Error creating post: `, error);
            setError(error.message || `Failed to create post. Please try again.`);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="p-4">
            <header className="flex items-center mb-6">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeftIcon className="h-5 w-5" /></button>
                <h2 className="text-xl font-bold ml-4">Create New Post</h2>
            </header>
            <form onSubmit={handleSubmit} className="space-y-4">
                {preview ? (
                    <div className="w-full aspect-square rounded-lg overflow-hidden bg-black flex items-center justify-center">
                        {mediaType === 'image' ? (
                            <img loading="lazy" src={preview} alt="Preview" className="w-full h-full object-contain" />
                        ) : (
                            <video src={preview} controls className="w-full h-full object-contain" />
                        )}
                    </div>
                ) : (
                    <div className="w-full aspect-square border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg flex flex-col items-center justify-center text-center p-4">
                        <PhotoIcon className="h-12 w-12 text-gray-400 dark:text-gray-500" />
                        <label htmlFor="file-upload" className="mt-2 text-sm font-semibold text-sky-600 dark:text-sky-400 cursor-pointer">
                            Select Media
                        </label>
                        <p className="text-xs text-gray-500 mt-1">Image or Video up to 25MB</p>
                        <input id="file-upload" type="file" accept="image/*,video/*" onChange={handleMediaChange} className="sr-only"/>
                    </div>
                )}
                
                <div>
                    <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Write a caption..." rows={4}
                        className="w-full p-3 border-2 border-transparent rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500"></textarea>
                </div>
                 {error && <p className="text-sm text-red-500">{error}</p>}
                <button type="submit" disabled={loading || !media} className="w-full h-12 flex items-center justify-center py-3 px-4 bg-sky-500 text-white font-semibold rounded-lg hover:bg-sky-600 disabled:opacity-50 transition-colors">
                    {loading ? <LoadingSpinner /> : 'Share'}
                </button>
            </form>
        </div>
    );
};

const CreateStoryForm: React.FC<{ onBack: () => void; onSuccess: () => void; }> = ({ onBack, onSuccess }) => {
    const { user } = useAuth();
    const [media, setMedia] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const mediaType = media?.type.startsWith('image/') ? 'image' : 'video';

    const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 25 * 1024 * 1024) { // 25MB limit
                setError('File is too large. Max size is 25MB.');
                return;
            }
            setError('');
            setMedia(file);
            setPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!media || !user) return;
        
        setLoading(true);
        setError('');

        try {
            const { url: mediaUrl, public_id: mediaPublicId } = await uploadMedia(media, user.uid, 'story');
            const createdAt = Timestamp.now();
            const expiresAt = new Timestamp(createdAt.seconds + 24 * 60 * 60, createdAt.nanoseconds);
            await addDoc(collection(db, 'stories'), {
                userId: user.uid,
                mediaUrl,
                mediaPublicId,
                createdAt,
                expiresAt,
            });
            onSuccess();
        } catch (err: any) {
            console.error(`Error creating story: `, err);
            setError(err.message || `Failed to create story. Please try again.`);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="p-4">
            <header className="flex items-center mb-6">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeftIcon className="h-5 w-5" /></button>
                <h2 className="text-xl font-bold ml-4">Create New Story</h2>
            </header>
            <form onSubmit={handleSubmit} className="space-y-4">
                {preview ? (
                    <div className="w-full aspect-[9/16] rounded-lg overflow-hidden bg-black flex items-center justify-center">
                        {mediaType === 'image' ? (
                            <img loading="lazy" src={preview} alt="Preview" className="w-full h-full object-contain" />
                        ) : (
                            <video src={preview} controls className="w-full h-full object-contain" />
                        )}
                    </div>
                ) : (
                    <div className="w-full aspect-[9/16] border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg flex flex-col items-center justify-center text-center p-4">
                        <VideoIcon className="h-12 w-12 text-gray-400 dark:text-gray-500" />
                        <label htmlFor="file-upload" className="mt-2 text-sm font-semibold text-sky-600 dark:text-sky-400 cursor-pointer">
                            Select Media
                        </label>
                        <p className="text-xs text-gray-500 mt-1">Image or Video up to 25MB</p>
                        <input id="file-upload" type="file" accept="image/*,video/*" onChange={handleMediaChange} className="sr-only"/>
                    </div>
                )}
                 {error && <p className="text-sm text-red-500">{error}</p>}
                 
                <button type="submit" disabled={loading || !media} className="w-full h-12 flex items-center justify-center py-3 px-4 bg-sky-500 text-white font-semibold rounded-lg hover:bg-sky-600 disabled:opacity-50 transition-colors">
                    {loading ? <LoadingSpinner /> : 'Share to Story'}
                </button>
            </form>
        </div>
    );
};


const CreateCampaignForm: React.FC<{onBack: () => void, onSuccess: () => void}> = ({onBack, onSuccess}) => {
    const { user } = useAuth();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [budget, setBudget] = useState('');
    const [category, setCategory] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

     const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !title || !description || !budget || !category) {
            setError('All fields are required.');
            return;
        }
        setLoading(true);
        setError('');

        try {
            await addDoc(collection(db, 'campaigns'), {
                brandId: user.uid,
                title,
                description,
                budget: Number(budget),
                category,
                applicants: [],
                createdAt: serverTimestamp(),
            });
            onSuccess();
        } catch (err) {
            console.error("Error creating campaign: ", err);
            setError('Failed to create campaign. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
         <div className="p-4">
            <header className="flex items-center mb-6">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeftIcon className="h-5 w-5" /></button>
                <h2 className="text-xl font-bold ml-4">Create New Campaign</h2>
            </header>
            <form onSubmit={handleSubmit} className="space-y-4">
                <FormInput label="Campaign Title" value={title} onChange={setTitle} placeholder="e.g. Summer Sportswear Launch" required />
                <FormTextArea label="Description" value={description} onChange={setDescription} placeholder="Describe your campaign goals, target audience, and content requirements." required />
                <FormInput label="Budget ($)" value={budget} onChange={setBudget} placeholder="e.g. 1500" type="number" required />
                <FormInput label="Category" value={category} onChange={setCategory} placeholder="e.g., Fashion, Tech, Beauty" required />
                
                 {error && <p className="text-sm text-red-500">{error}</p>}
                 
                 <button type="submit" disabled={loading} className="w-full h-12 flex items-center justify-center py-3 px-4 bg-sky-500 text-white font-semibold rounded-lg hover:bg-sky-600 disabled:opacity-50 transition-colors">
                    {loading ? <LoadingSpinner /> : 'Publish Campaign'}
                </button>
            </form>
        </div>
    );
};

export default CreateScreen;