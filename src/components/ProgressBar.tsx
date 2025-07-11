const ProgressBar = ({ progress }: {progress: number}) => {
    return (
        <div className="progress mt-3" style={{ height: '25px' }}>
            <div
                className="progress-bar progress-bar-striped progress-bar-animated"
                role="progressbar"
                style={{ width: `${progress}%` }}
                aria-valuenow={progress}
                aria-valuemin={0} 
                aria-valuemax={100}
            >
                {Math.round(progress)}%
            </div>
        </div>
    );
};

export { ProgressBar };